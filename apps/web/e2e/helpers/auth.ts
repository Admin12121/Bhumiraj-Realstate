import type { Page } from "@playwright/test";
export async function login(page:Page,email:string,password:string){await page.goto("/sign-in");await page.getByLabel("Email").fill(email);await page.getByLabel("Password").fill(password);await page.getByRole("button",{name:"Sign in",exact:true}).click();}
