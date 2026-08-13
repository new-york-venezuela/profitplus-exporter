# SP: pSeleccionarSerialesSalidaDevolucion
**Tipo**: Seleccionar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saDevolucionProveedorReng`](../tables/saDevolucionProveedorReng.md)
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<Softech Consultores>
-- Create date: <17,4,2017>
-- Description:	<Se encarga de retornar un registro de la tabla saSeriales que coincida con el rowguid de una devolucion,,>
-- =============================================
CREATE PROCEDURE [dbo].[pSeleccionarSerialesSalidaDevolucion] 
	-- Add the parameters for the stored procedure here
	@gRowGuId uniqueidentifier, 
	@sCo_art char (30),
	@sCo_alma char (6),
	@sSerial varchar (40)

AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Insert statements for procedure here
	select S.* from saSeriales S inner join saDevolucionProveedorReng D on D.rowguid_doc =S.doc_num_e

where
	D.rowguid = @gRowGuId
	And  S.co_art = @sCo_art
	and  S.co_alma = @sCo_alma
	and  S.serial = @sSerial
END
```
