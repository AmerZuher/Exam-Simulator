// URL-friendly identifier derived from a group's name, e.g. "AWS Cert Prep!"
// -> "aws-cert-prep". Used to route exam groups as #/group/<slug> instead of
// a raw UUID — readable, and stable as long as the name (which must be
// unique per user) doesn't change.
export function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'group';
}
