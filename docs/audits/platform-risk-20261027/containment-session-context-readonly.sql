BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT session_user, current_user, current_setting('role', true) AS role_setting, auth.role() AS jwt_role;
ROLLBACK;
