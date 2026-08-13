# SP: pInsertarCostoHistoricoEntrada
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saCostoHistoricoEntrada`](../tables/saCostoHistoricoEntrada.md)
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saDistribCostoDestinoReng`](../tables/saDistribCostoDestinoReng.md)
- [`saDistribCostoRelaReng`](../tables/saDistribCostoRelaReng.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE : [pInsertarCostoHistoricoEntrada]
*DESCRIPCIÓN : Inserta un nuevo registro a la tabla saCostoHistoricoEntrada
*AUTOR : SOFTECH SISTEMAS
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarCostoHistoricoEntrada]
    (
      @gCod_Articulo_Rowguid UNIQUEIDENTIFIER ,
      @sCod_Almacen CHAR(6) ,
      @sTipo_Doc CHAR(4) ,
      @gDoc_Orig UNIQUEIDENTIFIER ,
      @gSalidaOrig UNIQUEIDENTIFIER = NULL ,
      @deCantidad DECIMAL(18, 5) ,
      @deCantidad_Usada DECIMAL(18, 5) ,
      @deCosto DECIMAL(18, 5) ,
      @sdFecha_Registro DATETIME , --DN
      @sdFecha_Emision DATETIME , --DN
      @sdFecha_Recepcion DATETIME , --DN
      @iValRengNum INT = 0
    )
AS 
    BEGIN

             
             Declare @decCostoDistribucion decimal(18,5)
             Set @decCostoDistribucion = 0;

             if (@sTipo_Doc = 'COMP')
             BEGIN
                           SELECT       @decCostoDistribucion = isnull(SUM(DCRR.monto),0)
                           FROM 
                                  saDistribCostoRelaReng AS DCRR
                                  INNER JOIN saDistribCostoDestinoReng AS DCDR ON DCDR.distrib_num = DCRR.distrib_num_destino   AND DCDR.reng_num = DCRR.reng_num_destino 
                                  INNER JOIN saDistribCosto DCE on DCE.distrib_num = DCDR.distrib_num
                                  WHERE DCDR.rowguid_comp = @gDoc_Orig
                                  AND DCE.Procesado = 1
                                  GROUP BY     DCDR.rowguid_comp
             END

        INSERT  INTO saCostoHistoricoEntrada
                ( cod_articulo_rowguid, cod_almacen, tipo_doc, doc_orig, cantidad, cantidad_usada, costo, fecha_registro,
                  fecha_emision, fecha_recepcion, rengNum, cod_costo_historico_salida_orig )
        VALUES
                ( @gCod_Articulo_Rowguid, @sCod_Almacen, @sTipo_Doc, @gDoc_Orig, @deCantidad, @deCantidad_Usada,
                  @deCosto + @decCostoDistribucion, @sdFecha_Registro, @sdFecha_Emision, @sdFecha_Recepcion, @iValRengNum, @gSalidaOrig )
    END
```
