import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Virtualclassroom from "../Pages/Virtualclassroom";
import Videocall from '../components/VideoCall'


export default function Approuter() {
  return (
    <Router>
      <div className="h-screen w-screen">
        <Routes>
          <Route path="/" element={<Videocall />} />
          <Route path="/virtual-classroom" element={<Virtualclassroom />} />
        </Routes>
      </div>
    </Router>
  );
}
