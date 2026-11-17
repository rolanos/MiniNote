using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MiniNote.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MergeChecklistIntoNoteBody : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "Notes",
                type: "character varying(2610000)",
                maxLength: 2610000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100000)",
                oldMaxLength: 100000);

            migrationBuilder.Sql("""
                LOCK TABLE "ChecklistItem" IN ACCESS EXCLUSIVE MODE;

                WITH tasks AS (
                    SELECT "NoteId", string_agg(
                        (CASE WHEN "IsCompleted" THEN '- [x] ' ELSE '- [ ] ' END)
                        || regexp_replace("Text", E'\r\n|\r|\n', E'\n  | ', 'g'),
                        E'\n' ORDER BY "Position", "Id"
                    ) AS body
                    FROM "ChecklistItem"
                    GROUP BY "NoteId"
                )
                UPDATE "Notes" AS note
                SET "Content" = CASE WHEN note."Content" = '' THEN tasks.body
                    ELSE note."Content" || E'\n\n' || tasks.body END,
                    "Version" = note."Version" + 1,
                    "LastUpdateFingerprint" = NULL
                FROM tasks
                WHERE note."Id" = tasks."NoteId";
                """);

            migrationBuilder.DropTable(
                name: "ChecklistItem");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Inline tasks remain in the body so downgrades do not duplicate or remove them.
            migrationBuilder.Sql("""
                DO $migration$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "Notes" WHERE length("Content") > 100000) THEN
                        RAISE EXCEPTION 'Some notes are too long for the previous version.';
                    END IF;
                END;
                $migration$;
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "Notes",
                type: "character varying(100000)",
                maxLength: 100000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(2610000)",
                oldMaxLength: 2610000);

            migrationBuilder.CreateTable(
                name: "ChecklistItem",
                columns: table => new
                {
                    NoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    Position = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistItem", x => new { x.NoteId, x.Id });
                    table.ForeignKey(
                        name: "FK_ChecklistItem_Notes_NoteId",
                        column: x => x.NoteId,
                        principalTable: "Notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistItem_NoteId_Position",
                table: "ChecklistItem",
                columns: new[] { "NoteId", "Position" });
        }
    }
}
