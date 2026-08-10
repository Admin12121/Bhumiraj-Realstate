import { PublicProfile } from "@/features/profiles/components/public-profile";
export default async function Page({params}:{params:Promise<{id:string}>}){const{id}=await params;return <PublicProfile id={id}/>}
