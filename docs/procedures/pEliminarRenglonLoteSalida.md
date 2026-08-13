# SP: pEliminarRenglonLoteSalida
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pEliminarRenglonesLoteSalida]
DESCRIPCION: Elimina la información del lote dado su rowguid de origen
	empleado en Store Procedure de eliminar renglones
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonLoteSalida]
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
              Rowguid_Lote UNIQUEIDENTIFIER ,
              rowguid UNIQUEIDENTIFIER
            )

        DELETE  FROM dbo.saLoteSalida
        OUTPUT  DELETED.cantidad ,
                DELETED.numero_lote ,
                DELETED.Rowguid_Lote ,
                DELETED.rowguid
                INTO @TableTimestamp
        WHERE   saLoteSalida.rowguid_reng = @gRowguid_Reng
                AND saLoteSalida.tipo_doc = @sTipo_doc


        DECLARE @dtFe_De DATETIME
        SET @dtFe_De = GETDATE()
		
        DECLARE CURSOR_PROCESAR CURSOR LOCAL FAST_FORWARD
        FOR
            SELECT  cantidad ,
                    numero_lote ,
                    Rowguid_Lote ,
                    rowguid
            FROM    @TableTimestamp
		
        OPEN CURSOR_PROCESAR

        DECLARE @pCantidad DECIMAL(18, 5)
        DECLARE @pNumeroLote CHAR(20)
        DECLARE @pRowguidLote UNIQUEIDENTIFIER
        DECLARE @pRowguid UNIQUEIDENTIFIER
        
        FETCH NEXT FROM CURSOR_PROCESAR INTO @pCantidad, @pNumeroLote,
            @pRowguidLote, @pRowguid

        WHILE @@FETCH_STATUS = 0 
            BEGIN
            
            
                DECLARE @strCampos VARCHAR(128)
				
                EXEC [dbo].[pActualizarLote] @gRowguid = @pRowguidLote,
                    @sNumero_Lote = @pNumeroLote, @deCantidad = @pCantidad,
                    @bPermiteStockNegativo = 1, @bSumarStock = 1
		
                SET @strCampos = 'Eliminacion de Lote '
                    + RTRIM(LTRIM(@pNumeroLote)) + ', Cantidad: '
                    + RTRIM(LTRIM(STR(@pCantidad)))
				
                EXEC [pInsertarPista] @sUsuario_
```
