use std::{collections::HashSet, net::SocketAddr, sync::Arc, time::Instant};

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    middleware,
    response::{Html, IntoResponse},
    routing::{get, post},
};
use clap::{Parser, Subcommand};
use rmcp::transport::streamable_http_server::{
    StreamableHttpServerConfig, StreamableHttpService, session::local::LocalSessionManager,
};
use tokio::sync::Mutex;
use tower_http::{cors::CorsLayer, services::ServeDir, trace::TraceLayer};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use kent_domain::{AuthContext, KentSchema};

mod auth;
mod html_import;
mod import;
mod mcp;

#[derive(Parser)]
#[command(name = "kent-api", about = "Kent Family & DNA Project API server")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Import data from extracted JSON file into Neo4j
    Import {
        /// Path to the extracted-data.json file
        #[arg(short, long)]
        file: String,
    },
    /// Import data from FTDNA source HTML file into Neo4j
    ImportHtml {
        /// Path to the source.html file
        #[arg(short, long)]
        file: String,
        /// Output parsed JSON without writing to Neo4j
        #[arg(long, default_value_t = false)]
        dry_run: bool,
    },
    /// Start the API server (default)
    Serve,
}

#[derive(Clone)]
pub struct Google {
    pub client_id: String,
    pub client_secret: String,
}

#[derive(Clone)]
pub struct AppState {
    pub schema: KentSchema,
    pub graph: kent_db::Neo4jGraph,
    /// Public origin, no trailing slash, e.g. https://kentfamilygene.com
    pub base_url: String,
    pub google: Option<Google>,
    /// Development only: sign every login in as this email, without Google.
    pub dev_login_email: Option<String>,
    /// Lower-case emails allowed to sign in to the admin UI and MCP (ADMIN_EMAILS, comma-separated).
    pub admin_emails: Arc<HashSet<String>>,
    pub http: reqwest::Client,
    pub auth_window: Arc<Mutex<(Instant, u32)>>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "kent_api=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Import { file }) => {
            run_import(&file).await;
        }
        Some(Commands::ImportHtml { file, dry_run }) => {
            run_html_import(&file, dry_run).await;
        }
        Some(Commands::Serve) | None => {
            run_server().await;
        }
    }
}

async fn run_import(file_path: &str) {
    let neo4j_uri = std::env::var("NEO4J_URI").unwrap_or_else(|_| "bolt://localhost:7687".into());
    let neo4j_user = std::env::var("NEO4J_USER").unwrap_or_else(|_| "neo4j".into());
    let neo4j_password = std::env::var("NEO4J_PASSWORD").expect("NEO4J_PASSWORD must be set");

    tracing::info!("Connecting to Neo4j at {neo4j_uri}");
    let graph = kent_db::create_pool(&neo4j_uri, &neo4j_user, &neo4j_password)
        .await
        .expect("Failed to connect to Neo4j");
    tracing::info!("Neo4j connection established");

    // Ensure search indexes exist
    if let Err(e) = kent_db::search::ensure_search_indexes(&graph).await {
        tracing::warn!("Failed to create search indexes: {e}");
    }

    import::run_import(&graph, file_path).await;
}

async fn run_html_import(file_path: &str, dry_run: bool) {
    if dry_run {
        tracing::info!("Dry-run mode: will parse HTML and output JSON without touching Neo4j");
        // Still need a dummy graph reference — but we won't actually use it.
        // Parse-only path avoids requiring Neo4j credentials for dry-run.
        let html = match std::fs::read_to_string(file_path) {
            Ok(c) => c,
            Err(e) => {
                tracing::error!("Failed to read file: {e}");
                return;
            }
        };
        let doc = html_import::parse_document::parse_html(&html);

        let participant_count: usize = doc
            .lineages
            .iter()
            .map(|l| l.participants.len())
            .sum::<usize>()
            + doc.newest_members.len();

        tracing::info!("Parse complete:");
        tracing::info!("  Lineages:           {}", doc.lineages.len());
        tracing::info!("  Newest members:     {}", doc.newest_members.len());
        tracing::info!("  Total participants: {participant_count}");
        tracing::info!("  Warnings:           {}", doc.warnings.len());

        for w in &doc.warnings {
            tracing::warn!("  {w}");
        }

        match serde_json::to_string_pretty(&doc) {
            Ok(json) => println!("{json}"),
            Err(e) => tracing::error!("Failed to serialize to JSON: {e}"),
        }
    } else {
        let neo4j_uri =
            std::env::var("NEO4J_URI").unwrap_or_else(|_| "bolt://localhost:7687".into());
        let neo4j_user = std::env::var("NEO4J_USER").unwrap_or_else(|_| "neo4j".into());
        let neo4j_password = std::env::var("NEO4J_PASSWORD").expect("NEO4J_PASSWORD must be set");

        tracing::info!("Connecting to Neo4j at {neo4j_uri}");
        let graph = kent_db::create_pool(&neo4j_uri, &neo4j_user, &neo4j_password)
            .await
            .expect("Failed to connect to Neo4j");

        if let Err(e) = kent_db::search::ensure_search_indexes(&graph).await {
            tracing::warn!("Failed to create search indexes: {e}");
        }

        html_import::run_html_import(&graph, file_path, false).await;
    }
}

async fn run_server() {
    let neo4j_uri = std::env::var("NEO4J_URI").unwrap_or_else(|_| "bolt://localhost:7687".into());
    let neo4j_user = std::env::var("NEO4J_USER").unwrap_or_else(|_| "neo4j".into());
    let neo4j_password = std::env::var("NEO4J_PASSWORD").expect("NEO4J_PASSWORD must be set");
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "./dist".into());

    tracing::info!("Connecting to Neo4j at {neo4j_uri}");
    let graph = kent_db::create_pool(&neo4j_uri, &neo4j_user, &neo4j_password)
        .await
        .expect("Failed to connect to Neo4j");
    tracing::info!("Neo4j connection established");

    // Ensure search indexes exist
    if let Err(e) = kent_db::search::ensure_search_indexes(&graph).await {
        tracing::warn!("Failed to create search indexes (Neo4j may not support fulltext): {e}");
    }

    // CMS slug/key uniqueness. Fatal, unlike the search indexes: without these
    // constraints duplicate slugs are accepted and page(slug:) becomes ambiguous.
    kent_db::content::ensure_content_constraints(&graph)
        .await
        .expect("Failed to create CMS content constraints");

    kent_db::oauth::ensure_oauth_constraints(&graph)
        .await
        .expect("Failed to create OAuth constraints");

    let schema = kent_domain::build_schema(graph.clone());
    let (state, host) = auth_state(schema, graph, port).expect("Invalid sign-in configuration");
    let dev_login = state.dev_login_email.is_some();

    let mcp_schema = state.schema.clone();
    let mcp_service: StreamableHttpService<mcp::Mcp, LocalSessionManager> =
        StreamableHttpService::new(
            move || Ok(mcp::Mcp::new(mcp_schema.clone())),
            Default::default(),
            StreamableHttpServerConfig::default()
                .with_allowed_hosts([host.clone(), format!("{host}:{port}")]),
        );

    let sign_in = Router::new()
        .route("/auth/login", get(auth::login))
        .route("/register", post(auth::register))
        .route("/authorize", get(auth::authorize))
        .route("/authorize/consent", post(auth::consent_post))
        .route("/token", post(auth::token))
        .route("/oauth/google/callback", get(auth::google_callback))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::rate_limit,
        ));

    // SPA fallback: serve static files, fall back to index.html for client-side
    // routing. `not_found_service(ServeFile)` returns index.html with a 404
    // status, which renders fine in a browser but reads as broken to proxies,
    // crawlers, and uptime checks — so serve the shell with an explicit 200.
    let index_path = format!("{static_dir}/index.html");
    let spa_service = ServeDir::new(&static_dir).fallback(get({
        let index_path = index_path.clone();
        move |uri: axum::http::Uri| spa_index(index_path.clone(), uri)
    }));

    let app = Router::new()
        .route("/graphql", get(graphql_playground).post(graphql_handler))
        .route("/health", get(health_check))
        .route("/auth/me", get(auth::me))
        .route("/auth/logout", post(auth::logout))
        .route(
            "/.well-known/oauth-protected-resource",
            get(auth::protected_resource),
        )
        .route(
            "/.well-known/oauth-protected-resource/mcp",
            get(auth::protected_resource),
        )
        .route(
            "/.well-known/oauth-authorization-server",
            get(auth::authorization_server),
        )
        .merge(sign_in)
        .nest_service(
            "/mcp",
            tower::ServiceBuilder::new()
                .layer(middleware::from_fn_with_state(
                    state.clone(),
                    auth::require_bearer,
                ))
                .service(mcp_service),
        )
        .fallback_service(spa_service)
        // Must never allow credentials: the CSRF check in graphql_handler relies on it.
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    // DEV_LOGIN_EMAIL signs in anyone who reaches the server, so then listen on loopback only.
    let ip = if dev_login {
        [127, 0, 0, 1]
    } else {
        [0, 0, 0, 0]
    };
    let addr = SocketAddr::from((ip, port));
    tracing::info!("Listening on http://{addr}");
    tracing::info!("GraphQL Playground at http://{addr}/graphql");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind address");
    axum::serve(listener, app).await.expect("Server error");
}

/// GraphQL POST handler.
async fn graphql_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> GraphQLResponse {
    let mut req = req.into_inner();

    // Only a JSON request can carry the session: an HTML form cannot send
    // application/json, and a cross-origin fetch with it needs a CORS preflight
    // that does not allow credentials. With SameSite=Lax, this blocks CSRF.
    let is_json = headers
        .get(axum::http::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("application/json"));
    let is_authenticated = is_json && auth::session_email(&state, &headers).await.is_some();
    req = req.data(AuthContext { is_authenticated });

    state.schema.execute(req).await.into()
}

/// GraphQL Playground (GET /graphql).
async fn graphql_playground() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

/// Serve the SPA shell for client-side routes. A missing file under /assets/
/// stays a 404 — that is a broken build, not a route.
async fn spa_index(index_path: String, uri: axum::http::Uri) -> impl IntoResponse {
    if uri.path().starts_with("/assets/") {
        return (StatusCode::NOT_FOUND, "Not found").into_response();
    }
    match tokio::fs::read_to_string(&index_path).await {
        Ok(html) => Html(html).into_response(),
        Err(e) => {
            tracing::error!("Failed to read {index_path}: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "index.html unavailable").into_response()
        }
    }
}

/// Health check endpoint.
async fn health_check() -> impl IntoResponse {
    StatusCode::OK
}

/// Reads BASE_URL, GOOGLE_CLIENT_ID/SECRET, ADMIN_EMAILS and DEV_LOGIN_EMAIL.
/// Returns the state and the BASE_URL host.
fn auth_state(
    schema: KentSchema,
    graph: kent_db::Neo4jGraph,
    port: u16,
) -> Result<(AppState, String), String> {
    let raw = std::env::var("BASE_URL").unwrap_or_else(|_| format!("http://localhost:{port}"));
    let (base_url, host) = parse_origin(&raw).map_err(|e| format!("BASE_URL: {e}"))?;
    let dev_login_email = std::env::var("DEV_LOGIN_EMAIL")
        .ok()
        .filter(|s| !s.is_empty());
    if dev_login_email.is_some() && !matches!(host.as_str(), "localhost" | "127.0.0.1") {
        return Err(
            "DEV_LOGIN_EMAIL skips sign-in and is allowed only when BASE_URL is localhost".into(),
        );
    }
    let google = match (
        std::env::var("GOOGLE_CLIENT_ID"),
        std::env::var("GOOGLE_CLIENT_SECRET"),
    ) {
        (Ok(client_id), Ok(client_secret)) if !client_id.is_empty() => Some(Google {
            client_id,
            client_secret,
        }),
        _ => None,
    };
    let admin_emails = parse_emails(&std::env::var("ADMIN_EMAILS").unwrap_or_default());
    if admin_emails.is_empty() {
        tracing::warn!("ADMIN_EMAILS is empty: nobody can sign in");
    }
    if dev_login_email
        .as_ref()
        .is_some_and(|e| !admin_emails.contains(&e.to_lowercase()))
    {
        return Err("DEV_LOGIN_EMAIL must also be listed in ADMIN_EMAILS".into());
    }
    if google.is_none() && dev_login_email.is_none() {
        tracing::warn!("GOOGLE_CLIENT_ID/SECRET not set: nobody can sign in");
    }
    let state = AppState {
        schema,
        graph,
        base_url,
        google,
        dev_login_email,
        admin_emails: Arc::new(admin_emails),
        http: reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?,
        auth_window: Arc::new(Mutex::new((Instant::now(), 0))),
    };
    Ok((state, host))
}

/// BASE_URL must be an http(s) origin only: the OAuth and Google callback paths are
/// added to it. Returns the canonical origin and its host.
fn parse_origin(s: &str) -> Result<(String, String), String> {
    let u = reqwest::Url::parse(s).map_err(|e| e.to_string())?;
    if !matches!(u.scheme(), "http" | "https")
        || !u.username().is_empty()
        || u.password().is_some()
        || u.path() != "/"
        || u.query().is_some()
        || u.fragment().is_some()
    {
        return Err(format!(
            "{s} must be an http(s) origin with no path, such as https://example.com"
        ));
    }
    let host = u.host_str().ok_or("no host")?.to_string();
    Ok((u.origin().ascii_serialization(), host))
}

fn parse_emails(s: &str) -> HashSet<String> {
    s.split(',')
        .map(|e| e.trim().to_lowercase())
        .filter(|e| e.contains('@'))
        .collect()
}

#[cfg(test)]
mod tests {
    #[test]
    fn parses_admin_emails() {
        let e = super::parse_emails(" A@Example.com, ,b@example.com,nope");
        assert_eq!(e.len(), 2);
        assert!(e.contains("a@example.com") && e.contains("b@example.com"));
    }

    #[test]
    fn base_url_must_be_an_origin() {
        let ok = |s| super::parse_origin(s).map(|(o, _)| o);
        assert_eq!(
            ok("https://kentfamilygene.com/"),
            Ok("https://kentfamilygene.com".into())
        );
        assert_eq!(
            ok("http://localhost:8080"),
            Ok("http://localhost:8080".into())
        );
        assert!(ok("https://kentfamilygene.com/admin").is_err());
        assert!(ok("https://u:p@kentfamilygene.com").is_err());
        assert!(ok("https://kentfamilygene.com/?a=1").is_err());
        assert!(ok("ftp://kentfamilygene.com").is_err());
    }
}
