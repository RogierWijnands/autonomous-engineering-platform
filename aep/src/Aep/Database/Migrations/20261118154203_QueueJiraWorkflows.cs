using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aep.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class QueueJiraWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Workflows_IssueId",
                table: "Workflows");

            migrationBuilder.AddColumn<string>(
                name: "Repository",
                table: "Workflows",
                type: "character varying(201)",
                maxLength: 201,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ExternalKey",
                table: "Issues",
                type: "character varying(128)",
                maxLength: 128,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "WebhookReceipts",
                columns: table => new
                {
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkflowId = table.Column<Guid>(type: "uuid", nullable: false),
                    PayloadHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WebhookReceipts", x => x.EventId);
                    table.ForeignKey(
                        name: "FK_WebhookReceipts_Workflows_WorkflowId",
                        column: x => x.WorkflowId,
                        principalTable: "Workflows",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Workflows_ActiveIssue",
                table: "Workflows",
                column: "IssueId",
                unique: true,
                filter: "\"Status\" IN ('Received', 'Running', 'Paused')");

            migrationBuilder.CreateIndex(
                name: "IX_WebhookReceipts_WorkflowId",
                table: "WebhookReceipts",
                column: "WorkflowId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WebhookReceipts");

            migrationBuilder.DropIndex(
                name: "IX_Workflows_ActiveIssue",
                table: "Workflows");

            migrationBuilder.DropColumn(
                name: "Repository",
                table: "Workflows");

            migrationBuilder.DropColumn(
                name: "ExternalKey",
                table: "Issues");

            migrationBuilder.CreateIndex(
                name: "IX_Workflows_IssueId",
                table: "Workflows",
                column: "IssueId");
        }
    }
}
