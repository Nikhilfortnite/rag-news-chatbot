import "../styles/Sidebar.scss";

function Sidebar({ sessions, activeSession, onSelectSession, onCreateSession, onDeleteSession, isOpen, onClose }) {
  return (
    <div className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <button className="sidebar__close" onClick={onClose}>
        ✖
      </button>

      <h2 className="sidebar__title">Sessions</h2>
      <button className="sidebar__new-session" onClick={onCreateSession}>
        <span className="sidebar__new-session-icon">+</span>
        New Session
      </button>
      <ul className="sidebar__list">
        {sessions.map((s) => (
          <li
            key={s.id}
            className={`sidebar__item ${activeSession === s.id ? "sidebar__item--active" : ""}`}
            onClick={() => {
              onSelectSession(s.id);
              onClose(); 
            }}
          >
            <span>{s.name || `Session ${s.id}`}</span>
            <button
              className="sidebar__delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSession?.(s.id);
              }}
            >
              ❌
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Sidebar;
