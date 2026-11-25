import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function Logout() {
    const { logout } = useAuth()
    const handleLogout = () => logout()
  return (
    <div>
        <button className="navbar-logout" type="button" onClick={()=>handleLogout()}>Logout</button>
      
    </div>
  )
}

export default Logout
