import React from 'react';
import VideoCall from './components/VideoCall';
import Approuter from './Routes/Approuter';

const App = () => {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Approuter />
    </div>
  );
};

export default App;
