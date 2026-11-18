using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Aep.Infrastructure.Database.Migrations
{
    public partial class RetireUnusedModels : Migration
    {
        // Retire the EF mappings without deleting potentially existing records.
        protected override void Up(MigrationBuilder migrationBuilder) { }

        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
