import { useState } from "react";
import { login } from "../services/api";
import "../styles/Login.scss";


function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (username.trim().length < 5) {
      setError("Username must be at least 5 characters.");
      return;
    }
    try {
      const response = await login(username.toLowerCase());
      const token = response.data.token;
      localStorage.setItem("usernameToken", token);
      onLogin(token);
    } catch (err) {
      setError("Login failed, try again.");
      console.error(err);
    }
  };

  return (
    <div className="login-screen">
      <form onSubmit={handleSubmit}>
        <h2>Enter your username</h2>
        <input
          type="text"
          value={username}
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">Continue</button>
      </form>
    </div>
  );
}

export default Login;
