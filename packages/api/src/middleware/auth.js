import jwt from 'jsonwebtoken';

export async function authenticate(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    request.userId = payload.sub;
    request.userEmail = payload.email;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
