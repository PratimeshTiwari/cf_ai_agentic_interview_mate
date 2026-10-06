import { Navigate, useNavigate } from "react-router";
import { LogOut, Play } from "lucide-react";
import { clearCurrentUser, getCurrentUser } from "../lib/session";

export function DashboardPage() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <main className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-2xl font-bold text-white">Hello, {user.name}</h1>
          <button
            onClick={() => {
              clearCurrentUser();
              navigate("/login");
            }}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Switch persona"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </header>
        <button
          onClick={() => navigate(`/interview/${crypto.randomUUID()}`)}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4 fill-current" /> Start a new interview
        </button>
      </div>
    </main>
  );
}
