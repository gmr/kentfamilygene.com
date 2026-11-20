//! MCP server: gives administrators the same GraphQL API the admin UI uses, so every
//! query and mutation the admin can run is available from Claude, and new ones appear
//! without changes here.

use async_graphql::parser::types::OperationType;
use http::request::Parts;
use kent_domain::{AuthContext, KentSchema};
use rmcp::{
    ErrorData, ServerHandler,
    handler::server::{tool::Extension, wrapper::Parameters},
    model::*,
    schemars::{self, JsonSchema},
    tool, tool_handler, tool_router,
};
use serde::Deserialize;
use serde_json::Value;

use crate::auth::AuthUser;

#[derive(Clone)]
pub struct Mcp {
    schema: KentSchema,
}

type R = Result<CallToolResult, ErrorData>;

#[derive(Deserialize, JsonSchema)]
pub struct GraphqlReq {
    /// A GraphQL document. Use graphql_schema to see the types and fields.
    query: String,
    /// Variables for the document, as a JSON object.
    variables: Option<Value>,
}

/// Returns an error message if the document is not valid or has the wrong operation type.
fn check_kind(query: &str, mutation: bool) -> Option<String> {
    let doc = match async_graphql::parser::parse_query(query) {
        Ok(d) => d,
        Err(e) => return Some(e.to_string()),
    };
    let bad = doc
        .operations
        .iter()
        .any(|(_, op)| (op.node.ty == OperationType::Mutation) != mutation);
    bad.then(|| {
        if mutation {
            "mutate accepts only mutations; use the query tool to read".into()
        } else {
            "query accepts only queries; use the mutate tool to change data".into()
        }
    })
}

#[tool_router]
impl Mcp {
    pub fn new(schema: KentSchema) -> Self {
        Self { schema }
    }

    async fn run(&self, r: GraphqlReq, mutation: bool) -> R {
        if let Some(msg) = check_kind(&r.query, mutation) {
            return Ok(CallToolResult::error(vec![ContentBlock::text(msg)]));
        }
        let mut req = async_graphql::Request::new(r.query).data(AuthContext {
            is_authenticated: true,
        });
        if let Some(v) = r.variables {
            req = req.variables(async_graphql::Variables::from_json(v));
        }
        let resp = self.schema.execute(req).await;
        let failed = resp.is_err();
        let v = serde_json::to_value(&resp)
            .map_err(|e| ErrorData::internal_error(e.to_string(), None))?;
        Ok(if failed {
            CallToolResult::structured_error(v)
        } else {
            CallToolResult::structured(v)
        })
    }

    #[tool(
        description = "The GraphQL schema (SDL) of the Kent Family & DNA Project: lineages, persons, \
        participants, places, haplogroups, DNA tests, online trees, admin notes, relationships and CMS \
        pages, snippets and navigation. Read it before you write a query or mutation.",
        annotations(read_only_hint = true)
    )]
    async fn graphql_schema(&self) -> R {
        Ok(CallToolResult::success(vec![ContentBlock::text(
            self.schema.sdl(),
        )]))
    }

    #[tool(
        description = "Run a GraphQL query (read only) as an administrator. Living persons are not masked.",
        annotations(read_only_hint = true)
    )]
    async fn query(&self, Parameters(r): Parameters<GraphqlReq>) -> R {
        self.run(r, false).await
    }

    #[tool(
        description = "Run a GraphQL mutation as an administrator: create, update, delete and link data. \
        Ask the user before any delete.",
        annotations(destructive_hint = true)
    )]
    async fn mutate(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(r): Parameters<GraphqlReq>,
    ) -> R {
        let who = parts.extensions.get::<AuthUser>().map(|u| u.0.as_str());
        tracing::info!(who, query = %r.query, "MCP mutation");
        self.run(r, true).await
    }
}

#[tool_handler]
impl ServerHandler for Mcp {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build()).with_instructions(
            "Administration of the Kent Family & DNA Project genealogy database (kentfamilygene.com). \
             Call graphql_schema first, then use query to read and mutate to change data. Entity ids are \
             UUID strings. List results use the { items total hasMore } shape. Changes are live on the \
             public site at once. Never guess kinship or identity; change only what the user asks. Ask \
             before any delete.",
        )
    }
}

#[cfg(test)]
mod tests {
    use super::check_kind;

    #[test]
    fn operation_kind() {
        assert!(check_kind("{ stats { lineageCount } }", false).is_none());
        assert!(check_kind("mutation { deletePage(id: \"x\") }", false).is_some());
        assert!(check_kind("mutation { deletePage(id: \"x\") }", true).is_none());
        assert!(check_kind("query A { a } mutation B { b }", true).is_some());
        assert!(check_kind("not graphql", false).is_some());
    }
}
