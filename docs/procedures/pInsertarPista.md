# SP: pInsertarPista
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saPista`](../tables/saPista.md)

## Código (excerpt)
```sql
/*************************************************************************
*NOMBRE			: pInsertarPistas
*DESCRIPCIÓN	: inserta una pista	
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [pInsertarPista]
    (
      @sUsuario_Id CHAR(6) ,
      @dtFecha DATETIME = NULL ,
      @sCo_Sucu CHAR(6) = NULL ,
      @sTablaOri VARCHAR(32) ,
      @rowguidOri UNIQUEIDENTIFIER = NULL ,
      @sTipo_Op CHAR(1) ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @deAUX01 DECIMAL(18, 5) = NULL ,
      @sAUX02 VARCHAR(30) = NULL
    )
AS 
    BEGIN
		

        --IF ( @dtFecha IS NULL ) 
            SET @dtFecha = GETDATE()

        INSERT  INTO saPista
                ( usuario_id, fecha, co_sucu, tipo_op, maquina, campos, AUX01, AUX02, tablaOri, rowguidOri, revisado,
                  trasnfe )
        VALUES
                ( @sUsuario_Id, @dtFecha, @sCo_Sucu, @sTipo_Op, @sMaquina, @sCampos, @deAUX01, @sAUX02, @sTablaOri,
                  @rowguidOri, @sRevisado, @sTrasnfe )
    END
```
