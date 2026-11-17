using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniNote.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProtectNoteWrites : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreationFingerprint",
                table: "Notes",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Version",
                table: "Notes",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreationFingerprint",
                table: "Notes");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "Notes");
        }
    }
}
