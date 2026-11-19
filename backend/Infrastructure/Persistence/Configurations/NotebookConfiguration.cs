using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniNote.Domain.Entities;

namespace MiniNote.Infrastructure.Persistence.Configurations;

public sealed class NotebookConfiguration : IEntityTypeConfiguration<Notebook>
{
    public void Configure(EntityTypeBuilder<Notebook> builder)
    {
        builder.HasKey(notebook => notebook.Id);
        builder.Property(notebook => notebook.Id).ValueGeneratedNever();
        builder.Property(notebook => notebook.Name).HasMaxLength(Notebook.MaxNameLength).IsRequired();
        builder.HasData(new { Id = Notebook.PersonalId, Name = Notebook.PersonalName });
    }
}
