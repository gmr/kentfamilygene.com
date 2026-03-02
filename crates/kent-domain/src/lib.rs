use async_graphql::{EmptySubscription, Schema};
use kent_db::Neo4jGraph as Graph;

pub mod auth;
pub mod mutation;
pub mod privacy;
pub mod query;
pub mod types;

pub use auth::AuthContext;
pub use mutation::MutationRoot;
pub use query::QueryRoot;

pub type KentSchema = Schema<QueryRoot, MutationRoot, EmptySubscription>;

/// Build the GraphQL schema with Neo4j pool in context.
pub fn build_schema(graph: Graph) -> KentSchema {
    Schema::build(QueryRoot, MutationRoot, EmptySubscription)
        .data(graph)
        .finish()
}
