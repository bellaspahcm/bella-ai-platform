export async function assertExecutionIdentity(db, executorIdentity) {
  const result = await db.query('SELECT current_user AS actor, session_user AS session_actor');
  const identity = result.rows[0];
  if (!executorIdentity || identity?.actor !== executorIdentity || identity?.session_actor !== executorIdentity) {
    const error = new Error('Database principal does not match the authorized executor identity.');
    error.code = 'EXECUTOR_DATABASE_IDENTITY_MISMATCH';
    throw error;
  }
}
