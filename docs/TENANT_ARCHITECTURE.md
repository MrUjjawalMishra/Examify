# Dedicated tenant architecture

The existing examify Worker is the production entry point. Preserve it until staging passes. The control plane has its own D1 database for owners, school registry, provisioning jobs and resource mappings. Each school gets a dedicated Worker with one tenant D1 binding and a deployment-fixed SCHOOL_ID. Tenant HTTP request bodies cannot select a database or override the deployment identity.

The central router resolves school codes through the registry and calls an allowlisted service binding. Tenant Workers must reject direct ingress when central routing is enabled. Owner sessions live in the control plane; they do not grant access to school answers. Cookie namespaces and routing must isolate owner and school sessions before central routing is enabled.

Provisioning reserves an immutable school ID and unique normalized code, records each resource identifier, applies versioned migrations, creates the first administrator, tests the environment, then marks the school active. Retries reconcile existing resources. Failed provisioning never becomes active. Suspension is enforced centrally and at the tenant session boundary. No expiry action deletes records.

Staging must use separately named Workers, databases and private R2 resources. No production bindings or student records may be reused. R2 object ownership and access must be checked against the authenticated tenant and user, not a caller-supplied prefix.

Current implementation: tenant identity/session schema, credential generation, password hashing and school HTTP authentication. Control plane, routing and provisioning are still pending. No remote resources have been provisioned under this design yet.
