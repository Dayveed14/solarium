import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import { ShopProvider } from './auth/ShopContext.jsx';
import { AssessmentProvider } from './components/AssessmentContext.jsx';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import './styles/site.css';
import './styles/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ShopProvider>
          <AssessmentProvider>
            <App />
          </AssessmentProvider>
        </ShopProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
