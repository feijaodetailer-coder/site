/** Telefone brasileiro → e-mail técnico usado pelo Supabase Auth (o cliente entra com WhatsApp + senha). */
export function clientLoginEmail(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) throw new Error("Informe um telefone brasileiro com DDD.");
  return { digits, phone: `+${digits}`, email: `cliente-${digits}@auth.feijaodetailer.invalid` };
}
