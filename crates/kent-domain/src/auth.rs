use async_graphql::Context;

/// Authentication context passed into GraphQL resolvers from the HTTP layer.
#[derive(Debug, Clone)]
pub struct AuthContext {
    pub is_authenticated: bool,
}

/// Guard that returns an error if the request is not authenticated.
pub fn require_auth(ctx: &Context<'_>) -> async_graphql::Result<()> {
    let auth = ctx.data::<AuthContext>()?;
    if !auth.is_authenticated {
        return Err("Authentication required".into());
    }
    Ok(())
}
