using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniNote.Domain.Entities;

namespace MiniNote.Infrastructure.Persistence.Configurations;

public sealed class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder)
    {
        builder.HasKey(note => note.Id);
        builder.Property(note => note.Id).ValueGeneratedNever();
        builder.Property(note => note.Title).HasMaxLength(Note.MaxTitleLength).IsRequired();
        builder.Property(note => note.Content).HasMaxLength(Note.MaxContentLength).IsRequired();
        builder.Property(note => note.CreatedAt).HasColumnType("timestamp with time zone");
        builder.HasIndex(note => new { note.CreatedAt, note.Id });
        builder.HasMany(note => note.Checklist).WithOne().HasForeignKey("NoteId")
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(note => note.Notebook).WithMany().HasForeignKey(note => note.NotebookId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
