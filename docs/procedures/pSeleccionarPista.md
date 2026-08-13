# SP: pSeleccionarPista
**Tipo**: Seleccionar
**Módulo**: General

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)
- [`saPista`](../tables/saPista.md)
- [`saTasa`](../tables/saTasa.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pSeleccionarPista
DESCRIPCION: Muestra las pistas asociadas a una tabla u objeto de negocios
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarPista]
    (
      @RowGuidOri UNIQUEIDENTIFIER
       
    )
AS 
    BEGIN
       declare @sTablaOri  varchar(32)
                -- SET NOCOUNT ON added to prevent extra result sets from
                -- interfering with SELECT statements.
        SET NOCOUNT ON ;
              
              select @sTablaOri =  tablaori FROM saPista  WHERE rowguidOri = @RowGuidOri
              if @sTablaOri='saTasa'
              BEGIN
                     SELECT fecha, usuario_id, 'M' as 'tipo_op', maquina, campos
                     FROM saPista
                     WHERE rowguidOri IN (select rowguid from saTasa where co_mone=isnull((select co_mone from saTasa where rowguid=@RowGuidOri),'')) 
                     ORDER BY fecha DESC
              END
              ELSE IF @sTablaOri='saImpuestoReng'
              BEGIN
                     SELECT fecha, usuario_id, tipo_op, maquina, campos
                     FROM saPista
                     WHERE rowguidOri IN (select rowguid from saImpuestoReng where cod_impuesto=isnull((select cod_impuesto from saImpuestoReng where rowguid=@RowGuidOri),'')) 
                     ORDER BY fecha DESC
              END
              ELSE
              BEGIN
                     SELECT fecha, usuario_id, tipo_op, maquina, campos
                     FROM saPista
                     WHERE rowguidOri = @RowGuidOri
                     ORDER BY fecha DESC
              END
    END
```
