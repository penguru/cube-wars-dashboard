import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleSuccess = async (credentialResponse) => {
    setError('');
    const result = await login(credentialResponse.credential);

    if (!result.success) {
      setError(result.error);
    }
  };

  const handleError = () => {
    setError('Google authentication failed. Please try again.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Cube Wars</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">Analytics Dashboard</h2>
          <p className="text-gray-600">Sign in with your Google account to access the dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleSuccess}
            onError={handleError}
            useOneTap
            theme="outline"
            size="large"
            text="signin_with"
            shape="rectangular"
          />
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Only authorized emails can access this dashboard.</p>
          <p className="mt-2">If you need access, please contact your administrator.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
