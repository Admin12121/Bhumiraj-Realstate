import { PropertyDetail } from "@/features/listings/components/property-detail";
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;return <PropertyDetail slug={slug}/>}
