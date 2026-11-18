using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aep.Infrastructure.Database.Migrations
{
    public partial class RenameAuditEventToEventHistory : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(name: "AuditEvents", newName: "EventHistory");
            migrationBuilder.RenameIndex(
                name: "IX_AuditEvents_WorkflowId_OccurredAt",
                table: "EventHistory",
                newName: "IX_EventHistory_WorkflowId_OccurredAt");
            migrationBuilder.Sql("""
                ALTER TABLE "EventHistory" RENAME CONSTRAINT "PK_AuditEvents" TO "PK_EventHistory";
                ALTER TABLE "EventHistory" RENAME CONSTRAINT "FK_AuditEvents_Workflows_WorkflowId" TO "FK_EventHistory_Workflows_WorkflowId";
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "EventHistory" RENAME CONSTRAINT "PK_EventHistory" TO "PK_AuditEvents";
                ALTER TABLE "EventHistory" RENAME CONSTRAINT "FK_EventHistory_Workflows_WorkflowId" TO "FK_AuditEvents_Workflows_WorkflowId";
                """);
            migrationBuilder.RenameIndex(
                name: "IX_EventHistory_WorkflowId_OccurredAt",
                table: "EventHistory",
                newName: "IX_AuditEvents_WorkflowId_OccurredAt");
            migrationBuilder.RenameTable(name: "EventHistory", newName: "AuditEvents");
        }
    }
}
