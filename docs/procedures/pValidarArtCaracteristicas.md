# SP: pValidarArtCaracteristicas
**Tipo**: Validar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarArtCaracteristicas]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER
AS 
    BEGIN


DECLARE @ValResult TABLE ( Motivo VARCHAR(256) )

DECLARE VALIDAR_CARACTERISTICA CURSOR LOCAL FAST_FORWARD
FOR 
	Select A.co_art, AJUS.rowguid , AJUS.tipo_doc,AJUS.num_Doc, AJUS.reng_num,
		isnull(C.co_lin01,''), isnull(C.co_lin02,''), isnull(C.co_lin03,''), isnull(C.co_lin04,''), isnull(C.co_lin05,''), 
		isnull(AJUS.co_lin01,''), isnull(AJUS.co_lin02,''), isnull(AJUS.co_lin03,''), isnull(AJUS.co_lin04,''), isnull(AJUS.co_lin05,'')
	From
		[dbo].[saArticulo] A
		left join [dbo].[savArtCaracteristica] AJUS ON AJUS.co_art = A.co_Art
		left join  [dbo].[saArtCaracteristica] C ON C.co_art = A.co_art
	Where 
	(not(isnull(C.co_lin01,'') = isnull(AJUS.co_lin01,'')) and AJUS.co_art is not null)
	or (not(isnull(C.co_lin02,'') = isnull(AJUS.co_lin02,'')) and AJUS.co_art is not null)
	or (not(isnull(C.co_lin03,'') = isnull(AJUS.co_lin03,'')) and AJUS.co_art is not null)
	or (not(isnull(C.co_lin04,'') = isnull(AJUS.co_lin04,'')) and AJUS.co_art is not null)
	or (not(isnull(C.co_lin05,'') = isnull(AJUS.co_lin05,'')) and AJUS.co_art is not null)

Declare @co_art char(30)
Declare @id uniqueidentifier
Declare @tipo_doc char(4)
Declare @num_doc  char(20)
Declare @reng_num int
Declare @co_lin01 char(6)
Declare @co_lin02 char(6)
Declare @co_lin03 char(6)
Declare @co_lin04 char(6)
Declare @co_lin05 char(6)
Declare @co_lin01Mov char(6)
Declare @co_lin02Mov char(6)
Declare @co_lin03Mov char(6)
Declare @co_lin04Mov char(6)
Declare @co_lin05Mov char(6)


OPEN VALIDAR_CARACTERISTICA
FETCH NEXT FROM VALIDAR_CARACTERISTICA INTO @co_art, @id, @tipo_doc, @num_doc, @reng_num,
		@co_lin01, @co_lin02, @co_lin03, @co_lin04, @co_lin05, 
		@co_lin01Mov, @co_lin02Mov, @co_lin03Mov, @co_lin04Mov, @co_lin05Mov


DECLARE @strMensaje varchar(256)
DECLARE @HoraCorrida DATETIME

WHILE @@FETCH_STATUS = 0 
BEGIN
	

	set @strMensaje = 'El artículo "'+ rtrim(@co_art)  + '" del documento "' + rtrim(@num_doc) + '" renglón "' + rtrim(CONVERT(VARCHAR, @reng_num)) +
			 '" tipo "' + rtrim(@tipo_doc) + '" no coincide con la definición de sus caraterística:'

	if (@co_lin01 <> @co_lin01Mov)
		Set @strMensaje = @strMensaje + ' Caract. 01 (' + rtrim(@co_lin01) + '<>' + rtrim(@co_lin01Mov) + ')'

	if (@co_lin02 <> @co_lin02Mov)
		Set @strMensaje = @strMensaje + ' Caract. 02 (' + r
```
