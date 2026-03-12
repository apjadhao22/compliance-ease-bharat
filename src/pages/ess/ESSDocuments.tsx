import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileArchive } from "lucide-react";

const ESSDocuments = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-bold">Documents</h1>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileArchive className="h-5 w-5" />
          Company Documents
        </CardTitle>
        <CardDescription>Notices, policies, and shared documents from HR</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="py-8 text-center text-sm text-muted-foreground">
          No documents shared yet. Check back later.
        </p>
      </CardContent>
    </Card>
  </div>
);

export default ESSDocuments;
