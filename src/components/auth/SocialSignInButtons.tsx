import { Button } from "@/components/ui/button";

const GoogleIcon = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.9-4.73 1.9-3.87 0-7-3.13-7-7s3.13-7 7-7c1.93 0 3.33.73 4.4 1.6l2.5-2.5C18.16 3.73 15.6 2.5 12.48 2.5c-5.48 0-9.98 4.5-9.98 10s4.5 10 9.98 10c5.3 0 9.4-3.5 9.4-9.5V10.92h-9.4z"
      ></path>
    </svg>
  );
  

export function SocialSignInButtons() {
  return (
    <div className="space-y-3">
       <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>
      <Button variant="outline" className="w-full">
        <GoogleIcon />
        <span className="ml-2">Sign in with Google</span>
      </Button>
    </div>
  );
}
