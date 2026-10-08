"use client";
import { withBase } from "@/lib/base";
import { apiFetch } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { useState, type FormEvent } from "react";
import { KeyRound, LogIn, UserRoundPlus } from "lucide-react";
import "./customer-auth.css";

type VehicleInput = { vehicle: string; plate: string };
type Profile = { name: string; phone: string; contactEmail: string; address: string; vehicles: VehicleInput[] };

function loginEmail(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return `cliente-${digits}@auth.feijaodetailer.invalid`;
}

export default function CustomerAuth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profile, setProfile] = useState<Profile>({ name: "", phone: "", contactEmail: "", address: "", vehicles: [{ vehicle: "", plate: "" }] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    if (password.length < 8) { setError("Use uma senha com pelo menos 8 caracteres."); return; }
    setBusy(true);
    try {
      const supabase = getSupabase();
      const email = loginEmail(mode === "register" ? profile.phone : phone);
      const signIn = async () => {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError || !data.session) throw new Error("Confira o telefone e a senha.");
        return data.session;
      };
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { name: profile.name } } });
        // Também permite repetir o cadastro com segurança se o Auth deu certo mas o perfil não foi concluído.
        const session = !signUpError && data.session ? data.session : await signIn().catch(() => { throw new Error(signUpError?.message || "Não recebemos uma sessão de acesso. A confirmação de e-mail precisa estar desligada para este cadastro sem SMS."); });
        if (!session) throw new Error("Não recebemos uma sessão de acesso.");
      } else {
        await signIn();
      }
      const sessionResponse = await apiFetch("/api/customer-auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, phone: mode === "register" ? profile.phone : phone, ...(mode === "register" ? { ...profile, vehicle: profile.vehicles[0]?.vehicle || "", plate: profile.vehicles[0]?.plate || "" } : {}) }),
      });
      const session = await sessionResponse.json() as { error?: string; possibleExistingHistory?: boolean };
      if (!sessionResponse.ok) { await supabase.auth.signOut().catch(() => {}); throw new Error(session.error || "Não foi possível concluir seu cadastro."); }
      window.location.assign(withBase(session.possibleExistingHistory ? "/admin/?revisar-cadastro=1" : "/admin/"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar agora. Tente novamente.");
    } finally { setBusy(false); }
  };

  return <main className="main customer-auth-page"><div className="designer-auth-welcome"><p className="customer-auth-eyebrow">SEU ESPAÇO NA FEIJÃO DETAILER</p><h2>O cuidado continua<br/><em>por aqui.</em></h2><p>Seus veículos, próximos agendamentos e serviços. Tudo reunido para você acompanhar com tranquilidade.</p><img src={withBase("/service-images/limpeza-editorial.webp")} alt="Detalhamento automotivo com atenção ao acabamento"/></div><section className="customer-auth-card" aria-labelledby="customer-auth-title">
    <div className="customer-auth-mark"><KeyRound size={20}/></div>
    <p className="customer-auth-eyebrow">FEIJÃO DETAILER</p>
    <h1 id="customer-auth-title">{mode === "login" ? "Acesse sua área" : "Crie seu acesso"}</h1>
    <p className="customer-auth-intro">Acompanhe seus veículos, serviços e agendamentos em um só lugar.</p>
    <div className="customer-auth-switch" role="tablist" aria-label="Acesso do cliente">
      <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Entrar</button>
      <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>Primeiro acesso</button>
    </div>
    <form className="customer-auth-form" onSubmit={submit}>
      {mode === "register" && <>
        <label>Nome completo<input required autoComplete="name" maxLength={100} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label>
        <label>WhatsApp com DDD<input required type="tel" autoComplete="tel" placeholder="(31) 99999-9999" value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}/></label>
        <div className="customer-auth-vehicles"><p>Seus veículos <span className="customer-auth-optional">Você pode cadastrar mais de um</span></p>
          {profile.vehicles.map((vehicle, index) => <div className="customer-auth-vehicle" key={index}>
            <label>Veículo {index + 1}<input required maxLength={100} placeholder="Marca e modelo" value={vehicle.vehicle} onChange={e => setProfile({ ...profile, vehicles: profile.vehicles.map((item, i) => i === index ? { ...item, vehicle: e.target.value } : item) })}/></label>
            <label>Placa <span className="customer-auth-optional">opcional</span><input maxLength={12} value={vehicle.plate} onChange={e => setProfile({ ...profile, vehicles: profile.vehicles.map((item, i) => i === index ? { ...item, plate: e.target.value.toUpperCase() } : item) })}/></label>
            {profile.vehicles.length > 1 && <button type="button" className="customer-auth-remove-vehicle" onClick={() => setProfile({ ...profile, vehicles: profile.vehicles.filter((_, i) => i !== index) })}>Remover veículo</button>}
          </div>)}
          {profile.vehicles.length < 10 && <button type="button" className="customer-auth-add-vehicle" onClick={() => setProfile({ ...profile, vehicles: [...profile.vehicles, { vehicle: "", plate: "" }] })}>+ Adicionar outro veículo</button>}
        </div>
        
        <label>E-mail <span className="customer-auth-optional">opcional</span><input type="email" autoComplete="email" maxLength={160} value={profile.contactEmail} onChange={e => setProfile({ ...profile, contactEmail: e.target.value })}/></label>
        <label>Endereço <span className="customer-auth-optional">opcional</span><input autoComplete="street-address" maxLength={240} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })}/></label>
      </>}
      {mode === "login" && <label>WhatsApp com DDD<input required type="tel" autoComplete="tel" placeholder="(31) 99999-9999" value={phone} onChange={e => setPhone(e.target.value)}/></label>}
      <label>Senha<input required type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "register" ? "Mínimo de 8 caracteres" : "Sua senha"}/></label>
      {mode === "register" && <label>Confirme a senha<input required type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/></label>}
      {error && <p className="customer-auth-error" role="alert">{error}</p>}
      <button className="customer-auth-submit" disabled={busy}>{busy ? "Aguarde…" : mode === "login" ? <><LogIn size={18}/>Entrar na minha área</> : <><UserRoundPlus size={18}/>Criar acesso</>}</button>
    </form>
    <p className="customer-auth-security">Já é nosso cliente? A equipe confirma seus dados antes de conectar o histórico de serviços ao seu acesso.</p>
    {mode === "login" && <a className="customer-auth-help" href="https://wa.me/5531993444280?text=Preciso%20de%20ajuda%20para%20acessar%20ou%20redefinir%20minha%20senha" target="_blank" rel="noreferrer">Precisa de ajuda para entrar ou redefinir a senha?</a>}
  </section></main>;
}
