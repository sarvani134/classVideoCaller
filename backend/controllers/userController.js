import apiResponse from "../utils/grokAi.js"

export const aiChat=async(req,res)=>{
  try{
  const {message, teachingSource, teachingMode}=req.body
  if ( !message) {
      return res.json({
        err: "Incomplete data"
      });
    }
      const assistantResponse =
          await apiResponse(message,req.imageFile,teachingSource,req.teachingImageFile,teachingMode === "true");
           return res.json({
      assistantResponse
    });
    
        }
      
catch(err){
  console.error("AI chat failed:", err.message)
  return res.status(502).json({ msg: "The AI assistant could not answer right now. Please try again." })
}
}
