# SP: pValidarArtCaracteristicasRegDuplicados
**Tipo**: Validar
**Módulo**: General

## Tablas Referenciadas
- [`saArtCaracteristicaMov`](../tables/saArtCaracteristicaMov.md)

## Código (excerpt)
```sql
CREATE PROCEDURE [dbo].[pValidarArtCaracteristicasRegDuplicados]
    @bCorregir BIT = 0 , -- INDICA SI SE CORREGIRAN LAS INCONSISTENCIAS
    @IdProcess UNIQUEIDENTIFIER = null
AS 
    BEGIN
	
DECLARE VALIDAR_CARACTERISTICA CURSOR LOCAL FAST_FORWARD
FOR 
	select rowguidDoc, tipo_doc,
		co_lin01, co_lin02, co_lin03, co_lin04, co_lin05, 
		co_subl01, co_subl02, co_subl03, co_subl04, co_subl05, 
		sum(cantidad)
		 from saArtCaracteristicaMov
		 group by 
		 rowguidDoc,  tipo_doc,
		co_lin01, co_subl01,
		co_lin02, co_subl02,
		co_lin03, co_subl03,
		co_lin04, co_subl04,
		co_lin05, co_subl05
		having count(*) > 1

Declare @RowGuidDoc uniqueidentifier
Declare @tipo_doc char(4)
Declare @co_lin01 char(6)
Declare @co_lin02 char(6)
Declare @co_lin03 char(6)
Declare @co_lin04 char(6)
Declare @co_lin05 char(6)
Declare @co_sublin01 char(6)
Declare @co_sublin02 char(6)
Declare @co_sublin03 char(6)
Declare @co_sublin04 char(6)
Declare @co_sublin05 char(6)
Declare @deCantidad decimal (18,5)

OPEN VALIDAR_CARACTERISTICA
FETCH NEXT FROM VALIDAR_CARACTERISTICA INTO @RowGuidDoc, @tipo_doc,
		@co_lin01, @co_lin02, @co_lin03, @co_lin04, @co_lin05, 
		@co_sublin01, @co_sublin02, @co_sublin03, @co_sublin04, @co_sublin05,
		@deCantidad

DECLARE @ValResult TABLE ( Motivo VARCHAR(256) )
DECLARE @strMensaje varchar(256)

-- Lo llama la pantalla art carateristica
if (@IdProcess is null)
	Set @bCorregir = 1

WHILE @@FETCH_STATUS = 0 
BEGIN
		-- Lo llama Validar consistencia
		if (@IdProcess is not null)
		Begin
			Set @strMensaje = 'Existe más de un registro para el tipo de documento ' + @tipo_doc + ' identificador de documento ' + rtrim(convert(nvarchar(50), @RowGuidDoc))
			INSERT  INTO @ValResult ( Motivo ) VALUES (@strMensaje)
		End

		if (@bCorregir = 1)
		Begin
			Delete saArtCaracteristicaMov where rowguidDoc = @RowGuidDoc
			and isnull(co_lin01,'') = isnull(@co_lin01,'') 
			and isnull(co_lin02,'') = isnull(@co_lin02,'') 
			and isnull(co_lin03,'') = isnull(@co_lin03,'')
			and isnull(co_lin04,'') = isnull(@co_lin04,'') 
			and isnull(co_lin05,'') = isnull(@co_lin05,'')
			and isnull(co_subl01,'') = isnull(@co_sublin01,'') 
			and isnull(co_subl02,'') = isnull(@co_sublin02,'') 
			and isnull(co_subl03,'') = isnull(@co_sublin03,'') 
			and isnull(co_subl04,'') = isnull(@co_sublin04,'') 
			and isnull(co_subl05,'') = isnull(@co_sublin05,'')

			INSERT INTO [dbo].[saArtCaracteristicaMov]
			   ([rowguidDoc]
```
