use std::net::SocketAddr;

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use kent_domain::KentSchema;

#[derive(Clone)]
struct AppState {
    schema: KentSchema,
    admin_username: String,
    admin_password: String,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "kent_api=info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let neo4j_uri = std::env::var("NEO4J_URI").unwrap_or_else(|_| "bolt://localhost:7687".into());
    let neo4j_user = std::env::var("NEO4J_USER").unwrap_or_else(|_| "neo4j".into());
    let neo4j_password = std::env::var("NEO4J_PASSWORD").expect("NEO4J_PASSWORD must be set");
    let admin_username = std::env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".into());
    let admin_password = std::env::var("ADMIN_PASSWORD").expect("ADMIN_PASSWORD must be set");
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

    let schema = kent_domain::build_schema(graph);

    let state = AppState {
        schema,
        admin_username,
        admin_password,
    };

    // SPA fallback: serve static files, fall back to index.html for client-side routing
    let spa_service = ServeDir::new(&static_dir)
        .not_found_service(ServeFile::new(format!("{static_dir}/index.html")));

    let app = Router::new()
        .route("/graphql", get(graphql_playground).post(graphql_handler))
        .route("/health", get(health_check))
        .fallback_service(spa_service)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
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

    // Extract Basic Auth credentials and pass authentication status to resolvers
    let is_authenticated = check_basic_auth(&headers, &state.admin_username, &state.admin_password);
    req = req.data(AuthContext { is_authenticated });

    state.schema.execute(req).await.into()
}

/// GraphQL Playground (GET /graphql).
async fn graphql_playground() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

/// Health check endpoint.
async fn health_check() -> impl IntoResponse {
    StatusCode::OK
}

/// Authentication context passed into GraphQL resolvers.
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub is_authenticated: bool,
}

/// Decode and verify Basic Auth credentials.
fn check_basic_auth(headers: &HeaderMap, expected_user: &str, expected_pass: &str) -> bool {
    let Some(auth_header) = headers.get("authorization") else {
        return false;
    };
    let Ok(auth_str) = auth_header.to_str() else {
        return false;
    };
    let Some(encoded) = auth_str.strip_prefix("Basic ") else {
        return false;
    };
    let Ok(decoded_bytes) = BASE64.decode(encoded) else {
        return false;
    };
    let Ok(decoded) = String::from_utf8(decoded_bytes) else {
        return false;
    };
    let Some((user, pass)) = decoded.split_once(':') else {
        return false;
    };
    // Constant-time comparison to prevent timing side-channels
    let user_match = constant_time_eq(user.as_bytes(), expected_user.as_bytes());
    let pass_match = constant_time_eq(pass.as_bytes(), expected_pass.as_bytes());
    user_match & pass_match
}

/// Length-independent constant-time byte comparison.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        // Compare against expected to consume constant time even on length mismatch
        let mut result = 1u8;
        for (x, y) in a.iter().zip(a.iter()) {
            result &= ((x ^ y) == 0) as u8;
        }
        let _ = result;
        return false;
    }
    let mut result = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        result |= x ^ y;
    }
    result == 0
}
