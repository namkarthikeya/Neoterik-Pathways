export function withoutPassword(user) {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
