// Authentication component
import React, { useState } from 'react';
import { LogIn, UserPlus, Loader, Mail, Lock, User, CheckCircle, AlertCircle } from 'lucide-react';
import { register, login } from '../services/api';

const Auth = ({ onAuthSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear errors when user types
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let result;
      if (isLoginMode) {
        result = await login(formData.email, formData.password);
        setSuccess('Login successful!');
      } else {
        result = await register(formData.email, formData.password, formData.fullName);
        setSuccess('Registration successful! Logging you in...');
      }

      // Call parent callback after successful auth
      setTimeout(() => {
        if (onAuthSuccess) {
          onAuthSuccess(result);
        }
      }, 1000);

    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Authentication failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setError(null);
    setSuccess(null);
    setFormData({
      email: '',
      password: '',
      fullName: ''
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            {isLoginMode ? <LogIn size={32} /> : <UserPlus size={32} />}
          </div>
          <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
          <p>
            {isLoginMode 
              ? 'Sign in to access your synced files' 
              : 'Sign up to start syncing your files'
            }
          </p>
        </div>

        {error && (
          <div className="auth-message error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-message success">
            <CheckCircle size={20} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLoginMode && (
            <div className="form-group">
              <label htmlFor="fullName">
                <User size={16} />
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="John Doe"
                required={!isLoginMode}
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">
              <Mail size={16} />
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <Lock size={16} />
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
            />
            {!isLoginMode && (
              <small className="form-hint">
                Minimum 6 characters
              </small>
            )}
          </div>

          <button 
            type="submit" 
            className="auth-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="animate-spin" size={20} />
                {isLoginMode ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              <>
                {isLoginMode ? <LogIn size={20} /> : <UserPlus size={20} />}
                {isLoginMode ? 'Sign In' : 'Sign Up'}
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {isLoginMode ? "Don't have an account?" : "Already have an account?"}
            <button 
              onClick={toggleMode} 
              className="auth-toggle-button"
              disabled={loading}
            >
              {isLoginMode ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
