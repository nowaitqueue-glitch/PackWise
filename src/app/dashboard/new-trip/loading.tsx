import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewTripLoading() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </main>
  );
}
