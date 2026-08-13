# SP: pEliminarRenglonLoteEntrada
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pEliminarRenglonesLoteSalida]
DESCRIPCION: Elimina la información del lote dado su rowguid de origen
	empleado en Store Procedure de eliminar renglones
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonLoteEntrada]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @sTipo_doc CHAR(4) ,
      @sTablaOri CHAR(32) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6)
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              cantidad DECIMAL(18, 5) ,
              numero_lote CHAR(20) ,
              rowguid UNIQUEIDENTIFIER
            )

        DELETE  FROM dbo.saLoteEntrada
        OUTPUT  DELETED.cantidad ,
                DELETED.numero_lote ,
                DELETED.rowguid
                INTO @TableTimestamp
        WHERE   saLoteEntrada.rowguid_reng = @gRowguid_Reng
                AND saLoteEntrada.tipo_doc = @sTipo_doc


        DECLARE @dtFe_De DATETIME
        SET @dtFe_De = GETDATE()
		
        DECLARE CURSOR_PROCESAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT  cantidad ,
                    numero_lote ,
                    rowguid
            FROM    @TableTimestamp
		
        OPEN CURSOR_PROCESAR

        DECLARE @pCantidad DECIMAL(18, 5)
        DECLARE @pNumeroLote CHAR(20)
        DECLARE @pRowguidLote UNIQUEIDENTIFIER
        DECLARE @pRowguid UNIQUEIDENTIFIER
        
        FETCH NEXT FROM CURSOR_PROCESAR INTO @pCantidad, @pNumeroLote
            , @pRowguid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
            
            
                DECLARE @strCampos VARCHAR(128)
				
                --EXEC [dbo].[pActualizarLote] @gRowguid = @pRowguidLote,
                --    @sNumero_Lote = @pNumeroLote, @deCantidad = @pCantidad,
                --    @bPermiteStockNegativo = 1, @bSumarStock = 1
		
                SET @strCampos = 'Eliminacion de Lote '
                    + RTRIM(LTRIM(@pNumeroLote)) + ', Cantidad: '
                    + RTRIM(LTRIM(STR(@pCantidad)))
				
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo,
                    @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = @sTablaO
```
