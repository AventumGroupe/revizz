// Autorisation CORS pour l'appli Android (qui se présente comme https://localhost) sur les comptes et la synchronisation.
// Cette fonction « de bord » passe avant les fonctions Netlify : elle répond elle-même aux requêtes de vérification
// (OPTIONS) et ajoute les en-têtes CORS à toutes les réponses, y compris les pages d'erreur de Netlify.
import { entetesCors } from "../shared/jeton.mjs";

export default async (req, context) => {
  const cors = entetesCors(req, (k) => Netlify.env.get(k), "GET, POST, PUT, OPTIONS");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const res = await context.next();
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
};

export const config = { path: ["/api/compte/*", "/api/sync"] };
