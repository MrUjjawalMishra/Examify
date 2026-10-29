# Dedicated tenant architecture

The existing examify Worker is the production entry point. Preserve it until staging passes. The control plane has its own D1 database for owners, school registry, provisioning state and resource mappings. Each school gets a dedicated Worker with one tenant D1 binding and an immutable singleton school identity initialized through the trusted service binding. Tenant HTTP request bodies cannot select a database or override the identity.

The central router resolves school codes through the registry and calls an allowlisted service binding. Tenant Workers must reject direct ingress when central routing is enabled. Owner sessions live in the control plane; they do not grant access to school answers. Cookie namespaces and routing must isolate owner and school sessions before central routing is enabled.

Provisioning reserves an immutable school ID and unique normalized code, records each resource identifier, applies versioned migrations, creates the first administrator, tests the environment, then marks the school active. Retries reconcile existing resources. Failed provisioning never becomes active. Suspension is enforced centrally and at the tenant session boundary. No expiry action deletes records.

Staging must use separately named Workers, databases and private R2 resources. No production bindings or student records may be reused. R2 object ownership and access must be checked against the authenticated tenant and user, not a caller-supplied prefix.

Current implementation includes the control plane, owner authentication, registry routing, two dedicated staging school slots, account provisioning, role management, private R2 storage and integrated React interfaces. See STAGING_ARCHITECTURE.md for capacity and lifecycle details and EXECUTION_STATUS.md for verification evidence. Automatic creation of unlimited infrastructure from the application is not implemented; the operator provisions the bounded pool before owner activation.
