import { Users } from "lucide-react";

export function CollaborativeAuthRequired() {
  return (
    <div>
      <div className="shopping-section-header">
        <div>
          <h2 className="section-title mb-1">
            <Users size={20} color="var(--primary)" />
            Lista de Compras Colaborativa
          </h2>
          <p className="text-[0.8rem] text-slate-500 ml-7">
            Login necessario para usar listas colaborativas
          </p>
        </div>
      </div>

      <div className="glass-card text-center py-12 px-4">
        <Users size={44} color="#334155" />
        <h3 className="text-slate-200 mt-3">Autenticacao necessaria</h3>
        <p className="text-slate-400 text-sm mt-1">
          Faca login para criar ou participar de listas colaborativas.
        </p>
      </div>
    </div>
  );
}
