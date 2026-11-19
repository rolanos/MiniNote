using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniNote.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SortLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortPosition",
                table: "Notes",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SortPosition",
                table: "Notebooks",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SortPosition",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "SortPosition",
                table: "Notebooks");
        }
    }
}
