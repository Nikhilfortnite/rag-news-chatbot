import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import ConfirmDialog from "./components/ConfirmDialog";
import Login from "./components/Login";
import {
  getAllSessions,
  createSession,
  clearChatHistory,
  deleteSession,
} from "./services/api";
import "./styles/index.scss";

function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  // Auth state
  const [token, setToken] = useState(localStorage.getItem("usernameToken"));

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const loadSessions = async () => {
    if (!token) return; 

    try {
      const { data } = await getAllSessions();
      if (data && data.length > 0) {
        setSessions(data);
        setActiveSession(data[0].id);
      } else {
        setSessions([]);
        setActiveSession(null);
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [token]); // ✅ reload when token changes

  const handleCreateSession = async () => {
    if (!token) return;
    try {
      const { data: newSession } = await createSession();
      if (newSession) {
        setSessions((prev) => [...prev, newSession]);
        setActiveSession(newSession.id);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDeleteClick = (id) => {
    setSessionToDelete(id);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      if (sessionToDelete) {
        await clearChatHistory(sessionToDelete);

        const currentSession = activeSession;
        await deleteSession(sessionToDelete);
        loadSessions();

        if (activeSession !== sessionToDelete) {
          setActiveSession(currentSession?.id || null);
        }
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDialogOpen(false);
      setSessionToDelete(null);
    }
  };

  // If no token → show login screen
  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <div className="app-layout">
      <Sidebar
        sessions={sessions}
        activeSession={activeSession}
        onSelectSession={setActiveSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteClick}
      />

      <ChatWindow sessionId={activeSession} />

      <ConfirmDialog
        open={dialogOpen}
        title="Delete Session"
        message="Are you sure you want to delete this session?"
        onConfirm={confirmDelete}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}

export default App;
