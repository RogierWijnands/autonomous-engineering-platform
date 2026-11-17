using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aep.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class RenameIssueSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Workflows_Tickets_TicketId",
                table: "Workflows");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Tickets",
                table: "Tickets");

            migrationBuilder.RenameTable(
                name: "Tickets",
                newName: "Issues");

            migrationBuilder.RenameColumn(
                name: "TicketId",
                table: "Workflows",
                newName: "IssueId");

            migrationBuilder.RenameIndex(
                name: "IX_Workflows_TicketId",
                table: "Workflows",
                newName: "IX_Workflows_IssueId");

            migrationBuilder.RenameIndex(
                name: "IX_Tickets_Source_ExternalId",
                table: "Issues",
                newName: "IX_Issues_Source_ExternalId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Issues",
                table: "Issues",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Workflows_Issues_IssueId",
                table: "Workflows",
                column: "IssueId",
                principalTable: "Issues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Workflows_Issues_IssueId",
                table: "Workflows");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Issues",
                table: "Issues");

            migrationBuilder.RenameTable(
                name: "Issues",
                newName: "Tickets");

            migrationBuilder.RenameIndex(
                name: "IX_Issues_Source_ExternalId",
                table: "Tickets",
                newName: "IX_Tickets_Source_ExternalId");

            migrationBuilder.RenameColumn(
                name: "IssueId",
                table: "Workflows",
                newName: "TicketId");

            migrationBuilder.RenameIndex(
                name: "IX_Workflows_IssueId",
                table: "Workflows",
                newName: "IX_Workflows_TicketId");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Tickets",
                table: "Tickets",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Workflows_Tickets_TicketId",
                table: "Workflows",
                column: "TicketId",
                principalTable: "Tickets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
