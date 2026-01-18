"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl">Authentication Error</CardTitle>
          <CardDescription className="text-base">
            There was a problem verifying your email or resetting your password.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground space-y-2">
          <p>This could happen if:</p>
          <ul className="text-sm space-y-1">
            <li>The link has expired</li>
            <li>The link has already been used</li>
            <li>The link was invalid</li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button asChild className="w-full">
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Need a new link?{" "}
            <Link href="/forgot-password" className="text-primary hover:underline">
              Reset password
            </Link>
            {" or "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up again
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
