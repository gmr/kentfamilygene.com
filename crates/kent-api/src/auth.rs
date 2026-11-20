//! Sign-in for the admin UI and the MCP endpoint. Both use Google; only emails in
//! ADMIN_EMAILS get in, and every request checks the list again.
//!
//! - Admin UI: `/auth/login` → Google → a `kent_session` cookie (HttpOnly, SameSite=Lax).
//! - MCP: this server is its own OAuth 2.1 authorization server, per the MCP authorization
//!   spec: protected-resource and authorization-server metadata, dynamic client
//!   registration, PKCE (S256) and refresh-token rotation, with a consent page that names
//!   the client.
//!
//! Codes, tokens and sessions are random 256-bit values, stored as SHA-256 hashes.

use std::time::{Duration, Instant};

use axum::{
    Form, Json,
    extract::{Query, Request, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    middleware::Next,
    response::{Html, IntoResponse, Redirect, Response},
};
use axum_extra::headers::{Authorization, Cookie, HeaderMapExt, authorization::Bearer};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use html_escape::encode_safe;
use rand::RngCore;
use reqwest::Url;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::AppState;

const ACCESS_TTL: i64 = 3600;
const REFRESH_TTL: i64 = 30 * 24 * 3600;
const SESSION_TTL: i64 = 7 * 24 * 3600;
const PENDING_TTL: i64 = 600;
const CODE_TTL: i64 = 300;
const CLIENT_TTL: i64 = 10 * 365 * 24 * 3600;
const SESSION_COOKIE: &str = "kent_session";
const GOOGLE_AUTH: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN: &str = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO: &str = "https://openidconnect.googleapis.com/v1/userinfo";

/// The signed-in administrator's email, put in the request extensions for MCP tools.
#[derive(Clone, Debug)]
pub struct AuthUser(pub String);

#[derive(Serialize, Deserialize)]
struct Client {
    name: String,
    redirect_uris: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct OAuthRequest {
    client_id: String,
    redirect_uri: String,
    code_challenge: String,
    client_state: Option<String>,
}

/// A Google sign-in in progress, keyed by the `state` sent to Google.
#[derive(Serialize, Deserialize)]
enum Pending {
    Login,
    Mcp(OAuthRequest),
}

/// An MCP request after sign-in, waiting on the consent page.
#[derive(Serialize, Deserialize)]
struct Consent {
    req: OAuthRequest,
    email: String,
}

#[derive(Serialize, Deserialize)]
struct Session {
    email: String,
}

#[derive(Serialize, Deserialize)]
struct Code {
    client_id: String,
    email: String,
    redirect_uri: String,
    code_challenge: String,
}

#[derive(Serialize, Deserialize)]
struct Token {
    client_id: String,
    email: String,
}

fn random_token() -> String {
    let mut b = [0u8; 32];
    rand::rng().fill_bytes(&mut b);
    URL_SAFE_NO_PAD.encode(b)
}

fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}

// ── grant storage (kent_db::oauth) with JSON data ─────────────────

async fn save<T: Serialize>(st: &AppState, key: &str, kind: &str, v: &T, ttl: i64) -> bool {
    let data = serde_json::to_string(v).expect("serializable");
    match kent_db::oauth::save_grant(&st.graph, key, kind, &data, ttl).await {
        Ok(()) => true,
        Err(e) => {
            tracing::error!("save {kind} grant: {e}");
            false
        }
    }
}

fn decode<T: DeserializeOwned>(r: Result<Option<String>, kent_db::Error>) -> Option<T> {
    r.map_err(|e| tracing::error!("read grant: {e}"))
        .ok()
        .flatten()
        .and_then(|s| serde_json::from_str(&s).ok())
}

async fn get<T: DeserializeOwned>(st: &AppState, key: &str, kind: &str) -> Option<T> {
    decode(kent_db::oauth::get_grant(&st.graph, key, kind).await)
}

async fn take<T: DeserializeOwned>(st: &AppState, key: &str, kind: &str) -> Option<T> {
    decode(kent_db::oauth::take_grant(&st.graph, key, kind).await)
}

fn unavailable() -> Response {
    StatusCode::SERVICE_UNAVAILABLE.into_response()
}

fn oauth_error(status: StatusCode, error: &str, description: &str) -> Response {
    (
        status,
        Json(json!({"error": error, "error_description": description})),
    )
        .into_response()
}

/// ponytail: one global counter for the sign-in endpoints; per-IP buckets if abuse ever
/// shows up. 120 requests a minute is far above what a few administrators need.
pub async fn rate_limit(State(st): State<AppState>, req: Request, next: Next) -> Response {
    {
        let mut w = st.auth_window.lock().await;
        if w.0.elapsed() > Duration::from_secs(60) {
            *w = (Instant::now(), 0);
        }
        w.1 += 1;
        if w.1 > 120 {
            return oauth_error(
                StatusCode::TOO_MANY_REQUESTS,
                "slow_down",
                "too many sign-in requests; try again in a minute",
            );
        }
    }
    next.run(req).await
}

fn page(status: StatusCode, msg: &str) -> Response {
    let body = format!(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Sign in</title>\
         <body style='font:16px system-ui;max-width:36em;margin:3em auto;padding:0 16px'><h1>Kent Family &amp; DNA Project</h1><p>{}</p>",
        encode_safe(msg)
    );
    (status, Html(body)).into_response()
}

fn allowed(st: &AppState, email: &str) -> bool {
    st.admin_emails.contains(&email.to_lowercase())
}

// ── Google ────────────────────────────────────────────────────────

fn callback_url(st: &AppState) -> String {
    format!("{}/oauth/google/callback", st.base_url)
}

/// Saves the sign-in in progress under a random `state` and sends the browser to Google.
async fn start_google(st: &AppState, pending: Pending) -> Response {
    let Some(g) = &st.google else {
        return page(
            StatusCode::SERVICE_UNAVAILABLE,
            "Sign-in is not configured on this server.",
        );
    };
    let state = random_token();
    if !save(st, &hash(&state), "pending", &pending, PENDING_TTL).await {
        return unavailable();
    }
    let url = Url::parse_with_params(
        GOOGLE_AUTH,
        &[
            ("client_id", g.client_id.as_str()),
            ("redirect_uri", &callback_url(st)),
            ("response_type", "code"),
            ("scope", "openid email"),
            ("state", &state),
            ("prompt", "select_account"),
        ],
    )
    .expect("static url");
    Redirect::to(url.as_str()).into_response()
}

#[derive(Deserialize)]
pub struct GoogleCallback {
    code: Option<String>,
    state: String,
    error: Option<String>,
}

/// Shared by both flows: the `state` names an admin login or an MCP request.
pub async fn google_callback(
    State(st): State<AppState>,
    Query(q): Query<GoogleCallback>,
) -> Response {
    let Some(pending) = take::<Pending>(&st, &hash(&q.state), "pending").await else {
        return page(
            StatusCode::BAD_REQUEST,
            "This sign-in link has expired. Start again.",
        );
    };
    let email = match (q.code, q.error) {
        (Some(code), None) => Some(google_email(&st, &code).await.map_err(|e| {
            tracing::warn!("Google sign-in failed: {e}");
        })),
        _ => None,
    };
    match (pending, email) {
        (Pending::Login, Some(Ok(email))) => start_session(&st, &email).await,
        (Pending::Login, Some(Err(()))) => {
            Redirect::to("/admin/login?error=google").into_response()
        }
        (Pending::Login, None) => Redirect::to("/admin/login?error=cancelled").into_response(),
        (Pending::Mcp(req), Some(Ok(email))) => consent(&st, req, &email).await,
        (Pending::Mcp(_), Some(Err(()))) => {
            page(StatusCode::BAD_GATEWAY, "Google sign-in failed. Try again.")
        }
        (Pending::Mcp(req), None) => redirect_with(
            &req.redirect_uri,
            ("error", "access_denied"),
            req.client_state.as_deref(),
        ),
    }
}

async fn google_email(
    st: &AppState,
    code: &str,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let g = st.google.as_ref().ok_or("Google is not configured")?;
    let tok: Value = st
        .http
        .post(GOOGLE_TOKEN)
        .form(&[
            ("code", code),
            ("client_id", &g.client_id),
            ("client_secret", &g.client_secret),
            ("redirect_uri", &callback_url(st)),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let access = tok["access_token"]
        .as_str()
        .ok_or("no access_token from Google")?;
    let info: Value = st
        .http
        .get(GOOGLE_USERINFO)
        .bearer_auth(access)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    if info["email_verified"] != json!(true) {
        return Err("Google email is not verified".into());
    }
    Ok(info["email"]
        .as_str()
        .ok_or("no email from Google")?
        .to_lowercase())
}

// ── admin UI session ──────────────────────────────────────────────

/// GET /auth/login: starts Google sign-in for the admin UI.
pub async fn login(State(st): State<AppState>) -> Response {
    if let Some(email) = st.dev_login_email.clone() {
        return start_session(&st, &email).await;
    }
    start_google(&st, Pending::Login).await
}

async fn start_session(st: &AppState, email: &str) -> Response {
    if !allowed(st, email) {
        tracing::warn!(email, "admin sign-in refused: not in ADMIN_EMAILS");
        return Redirect::to("/admin/login?error=forbidden").into_response();
    }
    let token = random_token();
    let session = Session {
        email: email.to_string(),
    };
    if !save(st, &hash(&token), "session", &session, SESSION_TTL).await {
        return unavailable();
    }
    tracing::info!(email, "admin signed in");
    let cookie = format!(
        "{SESSION_COOKIE}={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_TTL}{}",
        if st.base_url.starts_with("https://") {
            "; Secure"
        } else {
            ""
        }
    );
    (
        [(header::SET_COOKIE, cookie)],
        Redirect::to("/admin/dashboard"),
    )
        .into_response()
}

fn session_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .typed_get::<Cookie>()?
        .get(SESSION_COOKIE)
        .map(str::to_string)
}

/// The email of a valid admin session, if any.
pub async fn session_email(st: &AppState, headers: &HeaderMap) -> Option<String> {
    let token = session_cookie(headers)?;
    let s: Session = get(st, &hash(&token), "session").await?;
    allowed(st, &s.email).then_some(s.email)
}

/// GET /auth/me: who is signed in to the admin UI.
pub async fn me(State(st): State<AppState>, headers: HeaderMap) -> Response {
    match session_email(&st, &headers).await {
        Some(email) => Json(json!({"email": email})).into_response(),
        None => StatusCode::UNAUTHORIZED.into_response(),
    }
}

/// POST /auth/logout
pub async fn logout(State(st): State<AppState>, headers: HeaderMap) -> Response {
    if let Some(token) = session_cookie(&headers) {
        take::<Session>(&st, &hash(&token), "session").await;
    }
    (
        [(
            header::SET_COOKIE,
            format!("{SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"),
        )],
        StatusCode::NO_CONTENT,
    )
        .into_response()
}

// ── OAuth 2.1 authorization server for MCP ────────────────────────

pub async fn protected_resource(State(st): State<AppState>) -> Json<Value> {
    Json(json!({
        "resource": format!("{}/mcp", st.base_url),
        "authorization_servers": [st.base_url],
        "bearer_methods_supported": ["header"],
        "scopes_supported": ["mcp"],
    }))
}

pub async fn authorization_server(State(st): State<AppState>) -> Json<Value> {
    let b = &st.base_url;
    Json(json!({
        "issuer": b,
        "authorization_endpoint": format!("{b}/authorize"),
        "token_endpoint": format!("{b}/token"),
        "registration_endpoint": format!("{b}/register"),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp"],
    }))
}

#[derive(Deserialize)]
pub struct RegisterReq {
    #[serde(default)]
    redirect_uris: Vec<String>,
    #[serde(default)]
    client_name: String,
}

/// A redirect URI must be https, or http on the local machine (desktop and CLI clients).
fn redirect_ok(u: &str) -> bool {
    Url::parse(u).is_ok_and(|u| {
        u.fragment().is_none()
            && match u.scheme() {
                "https" => true,
                "http" => matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]")),
                _ => false,
            }
    })
}

pub async fn register(State(st): State<AppState>, Json(r): Json<RegisterReq>) -> Response {
    if r.redirect_uris.is_empty()
        || r.redirect_uris.len() > 10
        || !r.redirect_uris.iter().all(|u| redirect_ok(u))
    {
        return oauth_error(
            StatusCode::BAD_REQUEST,
            "invalid_redirect_uri",
            "redirect_uris must be https, or http on localhost",
        );
    }
    let id = random_token();
    let client = Client {
        name: r.client_name.chars().take(200).collect(),
        redirect_uris: r.redirect_uris,
    };
    if !save(&st, &id, "client", &client, CLIENT_TTL).await {
        return unavailable();
    }
    (
        StatusCode::CREATED,
        Json(json!({
            "client_id": id,
            "client_id_issued_at": chrono::Utc::now().timestamp(),
            "client_name": client.name,
            "redirect_uris": client.redirect_uris,
            "token_endpoint_auth_method": "none",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
        })),
    )
        .into_response()
}

#[derive(Deserialize)]
pub struct AuthorizeReq {
    response_type: String,
    client_id: String,
    redirect_uri: String,
    code_challenge: String,
    #[serde(default)]
    code_challenge_method: String,
    state: Option<String>,
}

pub async fn authorize(State(st): State<AppState>, Query(q): Query<AuthorizeReq>) -> Response {
    let client: Option<Client> = get(&st, &q.client_id, "client").await;
    // Never redirect to an unregistered URI: show the error here instead.
    if !client.is_some_and(|c| c.redirect_uris.contains(&q.redirect_uri)) {
        return page(
            StatusCode::BAD_REQUEST,
            "Unknown client or redirect address. Remove the connector and add it again.",
        );
    }
    if q.response_type != "code" || q.code_challenge_method != "S256" || q.code_challenge.len() < 43
    {
        return redirect_with(
            &q.redirect_uri,
            ("error", "invalid_request"),
            q.state.as_deref(),
        );
    }
    let req = OAuthRequest {
        client_id: q.client_id,
        redirect_uri: q.redirect_uri,
        code_challenge: q.code_challenge,
        client_state: q.state,
    };
    // Local development only (refused at start-up unless the base URL is localhost).
    if let Some(email) = st.dev_login_email.clone() {
        return consent(&st, req, &email).await;
    }
    start_google(&st, Pending::Mcp(req)).await
}

/// Redirects to a registered client URI with one result pair and the client's state.
fn redirect_with(redirect_uri: &str, (key, value): (&str, &str), state: Option<&str>) -> Response {
    let mut u = Url::parse(redirect_uri).expect("registered uri parses");
    u.query_pairs_mut().append_pair(key, value);
    if let Some(s) = state {
        u.query_pairs_mut().append_pair("state", s);
    }
    Redirect::to(u.as_str()).into_response()
}

/// After sign-in, asks the administrator to approve this client by name and return address,
/// so a link from someone else's registered client cannot silently mint tokens. The form's
/// one-time id (stored hashed, 10 minutes) is the CSRF token.
async fn consent(st: &AppState, req: OAuthRequest, email: &str) -> Response {
    if !allowed(st, email) {
        tracing::warn!(email, "MCP sign-in refused: not in ADMIN_EMAILS");
        return page(
            StatusCode::FORBIDDEN,
            &format!("{email} is not on the list of administrators for this site."),
        );
    }
    let name = get::<Client>(st, &req.client_id, "client")
        .await
        .map(|c| c.name)
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "(unnamed application)".into());
    let dest = Url::parse(&req.redirect_uri)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
        .unwrap_or_default();
    let id = random_token();
    let pending = Consent {
        req,
        email: email.to_string(),
    };
    if !save(st, &hash(&id), "consent", &pending, PENDING_TTL).await {
        return unavailable();
    }
    let body = format!(
        "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Allow access</title>\
         <body style='font:16px system-ui;max-width:36em;margin:3em auto;padding:0 16px;color:#0f172a'>\
         <h1 style='font-size:22px'>Kent Family &amp; DNA Project</h1>\
         <p>Signed in as <b>{email}</b>.</p>\
         <p>The application <b>{name}</b> asks to read and change all project data, and will receive access at \
         <b>{dest}</b>.</p><p>Allow it only if you started this from Claude just now.</p>\
         <form method=post action='/authorize/consent'><input type=hidden name=id value='{id}'>\
         <button name=decision value=allow style='font:600 15px system-ui;padding:10px 18px;border:0;border-radius:8px;background:#0f766e;color:#fff'>Allow</button> \
         <button name=decision value=deny style='font:600 15px system-ui;padding:10px 18px;border:1px solid #cbd5e1;border-radius:8px;background:#fff'>Deny</button></form>",
        email = encode_safe(email),
        name = encode_safe(&name),
        dest = encode_safe(&dest),
    );
    let mut r = Html(body).into_response();
    r.headers_mut().insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static("frame-ancestors 'none'"),
    );
    r.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    r
}

#[derive(Deserialize)]
pub struct ConsentForm {
    id: String,
    decision: String,
}

/// Issues the authorization code after the administrator approves.
pub async fn consent_post(State(st): State<AppState>, Form(f): Form<ConsentForm>) -> Response {
    let Some(Consent { req, email }) = take(&st, &hash(&f.id), "consent").await else {
        return page(
            StatusCode::BAD_REQUEST,
            "This approval has expired. Start again from Claude.",
        );
    };
    if f.decision != "allow" {
        return redirect_with(
            &req.redirect_uri,
            ("error", "access_denied"),
            req.client_state.as_deref(),
        );
    }
    let code = random_token();
    let row = Code {
        client_id: req.client_id.clone(),
        email: email.clone(),
        redirect_uri: req.redirect_uri.clone(),
        code_challenge: req.code_challenge,
    };
    if !save(&st, &hash(&code), "code", &row, CODE_TTL).await {
        return unavailable();
    }
    tracing::info!(email, client = %req.client_id, "MCP access approved");
    redirect_with(
        &req.redirect_uri,
        ("code", &code),
        req.client_state.as_deref(),
    )
}

#[derive(Deserialize)]
pub struct TokenReq {
    grant_type: String,
    code: Option<String>,
    redirect_uri: Option<String>,
    client_id: Option<String>,
    code_verifier: Option<String>,
    refresh_token: Option<String>,
}

pub async fn token(State(st): State<AppState>, Form(t): Form<TokenReq>) -> Response {
    let grant = match t.grant_type.as_str() {
        "authorization_code" => {
            let (Some(code), Some(verifier)) = (t.code, t.code_verifier) else {
                return oauth_error(
                    StatusCode::BAD_REQUEST,
                    "invalid_request",
                    "code and code_verifier are required",
                );
            };
            let Some(row) = take::<Code>(&st, &hash(&code), "code").await else {
                return oauth_error(
                    StatusCode::BAD_REQUEST,
                    "invalid_grant",
                    "unknown or expired code",
                );
            };
            let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
            if challenge != row.code_challenge
                || t.client_id.as_deref() != Some(row.client_id.as_str())
                || t.redirect_uri
                    .as_deref()
                    .is_some_and(|u| u != row.redirect_uri)
            {
                return oauth_error(
                    StatusCode::BAD_REQUEST,
                    "invalid_grant",
                    "PKCE, client or redirect mismatch",
                );
            }
            Token {
                client_id: row.client_id,
                email: row.email,
            }
        }
        "refresh_token" => {
            let Some(rt) = t.refresh_token else {
                return oauth_error(
                    StatusCode::BAD_REQUEST,
                    "invalid_request",
                    "refresh_token is required",
                );
            };
            // Only the client the token was issued to can use (and so consume) it.
            match take::<Token>(&st, &hash(&rt), "refresh").await {
                Some(found) if t.client_id.as_deref() == Some(found.client_id.as_str()) => found,
                _ => {
                    return oauth_error(
                        StatusCode::BAD_REQUEST,
                        "invalid_grant",
                        "unknown or expired refresh token",
                    );
                }
            }
        }
        _ => {
            return oauth_error(
                StatusCode::BAD_REQUEST,
                "unsupported_grant_type",
                "use authorization_code or refresh_token",
            );
        }
    };
    if !allowed(&st, &grant.email) {
        return oauth_error(
            StatusCode::BAD_REQUEST,
            "invalid_grant",
            "this account is no longer an administrator",
        );
    }
    let (access, refresh) = (random_token(), random_token());
    if !save(&st, &hash(&access), "access", &grant, ACCESS_TTL).await
        || !save(&st, &hash(&refresh), "refresh", &grant, REFRESH_TTL).await
    {
        return unavailable();
    }
    (
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({"access_token": access, "token_type": "Bearer", "expires_in": ACCESS_TTL, "refresh_token": refresh, "scope": "mcp"})),
    )
        .into_response()
}

/// Requires a valid access token on /mcp; on failure points the client at the metadata (RFC 9728).
pub async fn require_bearer(State(st): State<AppState>, mut req: Request, next: Next) -> Response {
    let token = req
        .headers()
        .typed_get::<Authorization<Bearer>>()
        .map(|a| a.token().to_string());
    let email = match token {
        // Removing an email from ADMIN_EMAILS (and restarting) ends its access at once.
        Some(t) => get::<Token>(&st, &hash(&t), "access")
            .await
            .map(|t| t.email)
            .filter(|e| allowed(&st, e)),
        None => None,
    };
    let Some(email) = email else {
        let mut r = StatusCode::UNAUTHORIZED.into_response();
        let v = format!(
            "Bearer resource_metadata=\"{}/.well-known/oauth-protected-resource\"",
            st.base_url
        );
        r.headers_mut().insert(
            header::WWW_AUTHENTICATE,
            HeaderValue::from_str(&v).expect("ascii"),
        );
        return r;
    };
    req.extensions_mut().insert(AuthUser(email));
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redirect_rules() {
        assert!(redirect_ok("https://claude.ai/api/mcp/auth_callback"));
        assert!(redirect_ok("http://localhost:33418/callback"));
        assert!(redirect_ok("http://127.0.0.1:5000/cb"));
        assert!(!redirect_ok("http://evil.example/cb"));
        assert!(!redirect_ok("javascript:alert(1)"));
        assert!(!redirect_ok("https://x.example/cb#frag"));
    }

    #[test]
    fn pkce_s256_matches_rfc7636_example() {
        let v = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            URL_SAFE_NO_PAD.encode(Sha256::digest(v.as_bytes())),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }
}
