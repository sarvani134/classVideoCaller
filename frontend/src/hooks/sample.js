import { useAuth } from "../context/AuthContext.jsx"
import { useEffect } from "react"


export const  useSaveUserSample=()=>{
    const {isAuthenticated,user,getAccessTokenSilently}=useAuth()
    useEffect(()=>{
        if(!isAuthenticated || !user)return
        

        async function saveProfile(params) {

            try{
        const controller=new AbortController()
        const token=await getAccessTokenSilently()


    }
    catch(err){
        console.log(err)
    }
            
        }
        

    },[isAuthenticated])

    

}
